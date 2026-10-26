#include <jni.h>
#include <stdio.h>
#include <string.h>
#include <mpi.h>

extern double dlamch_(const char *cmach);

JNIEXPORT jstring JNICALL
Java_com_seantinel_spike_NativeBridge_nativeHello(JNIEnv *env, jclass clazz) {
    char buf[2048];
    char mpiver[MPI_MAX_LIBRARY_VERSION_STRING] = {0};
    int mpiverlen = 0;
    MPI_Get_library_version(mpiver, &mpiverlen);

    char *nl = strchr(mpiver, '\n');
    if (nl) *nl = 0;

    double eps = dlamch_("E");

    snprintf(buf, sizeof(buf),
        "MPI: %s\nISSM dlamch('E') = %.6e",
        mpiver, eps);

    return (*env)->NewStringUTF(env, buf);
}
