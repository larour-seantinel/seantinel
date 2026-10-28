#!/bin/bash
set -e
cd "$(dirname "$0")"

export JAVA_HOME=/data/data/com.termux/files/usr/lib/jvm/java-25-openjdk
export PATH=$JAVA_HOME/bin:$PATH

ISSM=$HOME/issm
PETSC_LIB=$ISSM/externalpackages/petsc/install/lib
ANDROID_JAR=$HOME/android-33.jar
BUILD=build
LIBDIR=$BUILD/lib/arm64-v8a
APK_UNALIGNED=$BUILD/spike-unaligned.apk
APK_ALIGNED=$BUILD/spike-aligned.apk
APK_SIGNED=$BUILD/spike.apk
KEY_PK8=$BUILD/key.pk8
CERT_DER=$BUILD/cert.der

rm -rf $BUILD
mkdir -p $BUILD/gen $BUILD/classes $LIBDIR $BUILD/assets

echo "[1/9] stage ISSM libs"
# Format: SRC_PATH:DST_NAME  (DST_NAME uses plain .so for versioned libs)
STAGE=(
    "$ISSM/lib/libISSMCore.so:libISSMCore.so"
    "$PETSC_LIB/libpetsc.so.3.25.4:libpetsc.so"
    "$PETSC_LIB/libscalapack.so.2.2.3:libscalapack.so"
    "$PETSC_LIB/libmpi.so.12.6.0:libmpi.so"
    "$PETSC_LIB/libmpicxx.so.12.6.0:libmpicxx.so"
    "$PETSC_LIB/libmpifort.so.12.6.0:libmpifort.so"
    "$PETSC_LIB/libmetis.so:libmetis.so"
    "$PETSC_LIB/libparmetis.so:libparmetis.so"
    "$ISSM/lib/libslatec.so:libslatec.so"
    "/data/data/com.termux/files/usr/lib/libopenblas.so:libopenblas.so"
    "/data/data/com.termux/files/usr/lib/libc++_shared.so:libc++_shared.so"
    "/data/data/com.termux/files/usr/lib/libz.so.1.3.2:libz.so"
    "/data/data/com.termux/files/usr/lib/libandroid-shmem.so:libandroid-shmem.so"
)
for entry in "${STAGE[@]}"; do
    SRC="${entry%:*}"
    DST="${entry#*:}"
    cp "$SRC" "$LIBDIR/$DST"
done

echo "[2/9] patchelf SONAMEs + NEEDEDs to plain .so"
for lib in $LIBDIR/*.so; do
    patchelf --remove-rpath "$lib"
    patchelf --set-soname "$(basename $lib)" "$lib"
    patchelf --replace-needed libmpi.so.12 libmpi.so "$lib"
    patchelf --replace-needed libmpicxx.so.12 libmpicxx.so "$lib"
    patchelf --replace-needed libmpifort.so.12 libmpifort.so "$lib"
    patchelf --replace-needed libscalapack.so.2.2 libscalapack.so "$lib"
    patchelf --replace-needed libpetsc.so.3.25 libpetsc.so "$lib"
    patchelf --replace-needed libz.so.1 libz.so "$lib"
done

echo "[2b/9] patchelf: add libandroid-shmem.so to libpetsc NEEDED"
patchelf --add-needed libandroid-shmem.so $LIBDIR/libpetsc.so

echo "[3/9] llvm-strip large libs"
llvm-strip --strip-unneeded $LIBDIR/libISSMCore.so $LIBDIR/libpetsc.so $LIBDIR/libopenblas.so $LIBDIR/libscalapack.so

echo "[4a/9] build libissmstatics.so (statics issm.exe normally provides)"
INC="-I/data/data/com.termux/files/usr/include -I$ISSM/externalpackages/mpich/install/include"
clang++ -shared -fPIC -O2 $INC \
    -o $LIBDIR/libissmstatics.so \
    jni/issm_statics.cpp
patchelf --remove-rpath $LIBDIR/libissmstatics.so

echo "[4b/9] patchelf: add libissmstatics.so to libISSMCore NEEDED"
patchelf --add-needed libissmstatics.so $LIBDIR/libISSMCore.so

echo "[4c/9] build libspike.so"
ISSM_INC="-DHAVE_CONFIG_H -I$ISSM -I$ISSM/src/c \
    -I$ISSM/externalpackages/triangle/install/include \
    -I$ISSM/externalpackages/petsc/install/include \
    -I$ISSM/externalpackages/mpich/install/include"
clang++ -c -fPIC -O2 -std=gnu++17 $INC $ISSM_INC -o $BUILD/spike.o jni/spike.cpp
clang++ -shared -fPIC -O2 \
    -L$LIBDIR \
    -Wl,-rpath,'$ORIGIN' \
    -o $LIBDIR/libspike.so \
    $BUILD/spike.o \
    -lmpi -lISSMCore
patchelf --remove-rpath $LIBDIR/libspike.so

echo "[5/9] aapt2 compile + link (with assets)"
aapt2 compile --dir res -o $BUILD/compiled.zip
cp -r assets/* $BUILD/assets/
aapt2 link -I $ANDROID_JAR \
    --manifest AndroidManifest.xml \
    --java $BUILD/gen \
    -A $BUILD/assets \
    -o $APK_UNALIGNED \
    $BUILD/compiled.zip

echo "[6/9] ecj: compile Java"
dalvikvm -Xmx256m \
    -cp /data/data/com.termux/files/usr/share/dex/ecj.jar \
    org.eclipse.jdt.internal.compiler.batch.Main \
    -proc:none -8 \
    -classpath $ANDROID_JAR \
    -d $BUILD/classes \
    $(find src $BUILD/gen -name "*.java")

echo "[7/9] dx: dex classes"
dx --dex --output=$BUILD/classes.dex $BUILD/classes

echo "[8/9] add classes.dex + all libs to APK"
(cd $BUILD && aapt add $(basename $APK_UNALIGNED) classes.dex > /dev/null)
for lib in $LIBDIR/*.so; do
    (cd $BUILD && aapt add $(basename $APK_UNALIGNED) lib/arm64-v8a/$(basename $lib) > /dev/null)
done

echo "[9/9] zipalign + sign"
zipalign -f 4 $APK_UNALIGNED $APK_ALIGNED
if [ ! -f $KEY_PK8 ]; then
    openssl genrsa -out $BUILD/key.pem 2048 2>/dev/null
    openssl pkcs8 -topk8 -inform PEM -outform DER -in $BUILD/key.pem -out $KEY_PK8 -nocrypt 2>/dev/null
    openssl req -new -x509 -key $BUILD/key.pem -out $BUILD/cert.pem -days 10000 -subj "/CN=Seantinel" 2>/dev/null
    openssl x509 -in $BUILD/cert.pem -outform DER -out $CERT_DER
fi
apksigner sign --key $KEY_PK8 --cert $CERT_DER --out $APK_SIGNED $APK_ALIGNED

echo
echo "APK: $(pwd)/$APK_SIGNED"
ls -la $APK_SIGNED
echo
echo "lib sizes:"
du -h $LIBDIR/*.so | sort -h
