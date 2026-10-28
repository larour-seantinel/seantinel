#include <jni.h>
#include <stdio.h>
#include <string.h>
#include <string>
#include <sstream>
#include <sys/time.h>
#include <unistd.h>
#include <fcntl.h>
#include <mpi.h>

#include "../../../issm/src/c/main/issm.h"

extern "C" double dlamch_(const char *cmach);

extern "C" JNIEXPORT jstring JNICALL
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
    return env->NewStringUTF(buf);
}

static long tv_ms(const timeval& a, const timeval& b) {
    return (b.tv_sec - a.tv_sec) * 1000L + (b.tv_usec - a.tv_usec) / 1000L;
}

static bool test101_done = false;

extern "C" JNIEXPORT jstring JNICALL
Java_com_seantinel_spike_NativeBridge_nativeRunTest101(JNIEnv* env, jclass clazz, jstring jDir) {
    if (test101_done) {
        return env->NewStringUTF(
            "test101 already ran in this process.\n"
            "MPI_Init can only be called once per process lifetime (MPI standard).\n"
            "Force-stop the app and relaunch to run again.");
    }
    test101_done = true;

    const char* dir_c = env->GetStringUTFChars(jDir, nullptr);
    std::string dir(dir_c);
    env->ReleaseStringUTFChars(jDir, dir_c);

    std::string logPath = dir + "/test101.stdlog";
    int logfd = open(logPath.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
    int saved_stdout = dup(1);
    int saved_stderr = dup(2);
    if (logfd >= 0) {
        dup2(logfd, 1);
        dup2(logfd, 2);
        close(logfd);
    }

    char arg0[] = "issm";
    char arg1[] = "StressbalanceSolution";
    std::string arg2 = dir;
    char arg3[] = "test101";
    char* argv[] = { arg0, arg1, const_cast<char*>(arg2.c_str()), arg3, nullptr };
    int argc = 4;

    timeval t0, t1, t2, t3, t4;
    gettimeofday(&t0, nullptr);

    std::string status = "unknown";
    long envInit_ms = 0, fem_ms = 0, solve_ms = 0, output_ms = 0;

    try {
        ISSM_MPI_Comm comm_init = EnvironmentInit(argc, argv);
        gettimeofday(&t1, nullptr);
        envInit_ms = tv_ms(t0, t1);

        FemModel* femmodel = new FemModel(argc, argv, comm_init);
        femmodel->parameters->AddObject(new IntParam(IsSlcCouplingEnum, 0));
        gettimeofday(&t2, nullptr);
        fem_ms = tv_ms(t1, t2);

        femmodel->Solve();
        gettimeofday(&t3, nullptr);
        solve_ms = tv_ms(t2, t3);

        OutputResultsx(femmodel);
        femmodel->CleanUp();
        delete femmodel;
        EnvironmentFinalize();
        gettimeofday(&t4, nullptr);
        output_ms = tv_ms(t3, t4);

        status = "OK";
    } catch (ErrorException& e) {
        status = std::string("ErrorException: ") + e.what();
    } catch (std::exception& e) {
        status = std::string("std::exception: ") + e.what();
    } catch (...) {
        status = "unknown exception";
    }

    fflush(stdout);
    fflush(stderr);
    dup2(saved_stdout, 1);
    close(saved_stdout);
    dup2(saved_stderr, 2);
    close(saved_stderr);

    std::ostringstream out;
    out << "test101: " << status << "\n";
    if (status == "OK") {
        out << "EnvInit:  " << envInit_ms << " ms\n"
            << "FemModel: " << fem_ms << " ms\n"
            << "Solve:    " << solve_ms << " ms\n"
            << "Output:   " << output_ms << " ms\n";
    }
    out << "log: " << logPath;
    return env->NewStringUTF(out.str().c_str());
}
