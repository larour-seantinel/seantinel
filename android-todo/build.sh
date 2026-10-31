#!/bin/bash
set -e
cd "$(dirname "$0")"

# Termux's default openjdk-21 crashes on this device; openjdk-25 works.
export JAVA_HOME=/data/data/com.termux/files/usr/lib/jvm/java-25-openjdk
export PATH=$JAVA_HOME/bin:$PATH

ANDROID_JAR=$HOME/android-33.jar
BUILD=build
KEYDIR=.keys          # outside $BUILD so key survives `rm -rf build/`
APK_UNALIGNED=$BUILD/todo-unaligned.apk
APK_ALIGNED=$BUILD/todo-aligned.apk
APK_SIGNED=$BUILD/todo.apk
KEY_PK8=$KEYDIR/key.pk8
CERT_DER=$KEYDIR/cert.der

rm -rf $BUILD
mkdir -p $BUILD/gen $BUILD/classes $BUILD/compiled $KEYDIR

echo "[1/7] aapt2 compile: resources"
aapt2 compile --dir res -o $BUILD/compiled.zip

echo "[2/7] aapt2 link: base APK + R.java (includes assets/)"
aapt2 link -I $ANDROID_JAR \
    --manifest AndroidManifest.xml \
    -A assets \
    --java $BUILD/gen \
    -o $APK_UNALIGNED \
    $BUILD/compiled.zip

echo "[3/7] ecj: compile Java sources"
dalvikvm -Xmx256m \
    -cp /data/data/com.termux/files/usr/share/dex/ecj.jar \
    org.eclipse.jdt.internal.compiler.batch.Main \
    -proc:none -8 \
    -classpath $ANDROID_JAR \
    -d $BUILD/classes \
    $(find src $BUILD/gen -name "*.java")

echo "[4/7] dx: dex classes"
dx --dex --output=$BUILD/classes.dex $BUILD/classes

echo "[5/7] add classes.dex to APK"
(cd $BUILD && aapt add $(basename $APK_UNALIGNED) classes.dex > /dev/null)

echo "[6/7] zipalign + key/cert if missing"
zipalign -f 4 $APK_UNALIGNED $APK_ALIGNED
if [ ! -f $KEY_PK8 ]; then
    openssl genrsa -out $KEYDIR/key.pem 2048 2>/dev/null
    openssl pkcs8 -topk8 -inform PEM -outform DER -in $KEYDIR/key.pem -out $KEY_PK8 -nocrypt 2>/dev/null
    openssl req -new -x509 -key $KEYDIR/key.pem -out $KEYDIR/cert.pem -days 10000 -subj "/CN=Seantinel" 2>/dev/null
    openssl x509 -in $KEYDIR/cert.pem -outform DER -out $CERT_DER
fi

echo "[7/7] apksigner: sign APK"
apksigner sign --key $KEY_PK8 --cert $CERT_DER --out $APK_SIGNED $APK_ALIGNED

echo
echo "APK: $(pwd)/$APK_SIGNED"
ls -la $APK_SIGNED
