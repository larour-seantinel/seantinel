#include <mpi.h>

class IssmComm {
public:
    static MPI_Comm comm;
    static bool parallel;
};

class ToolkitOptions {
public:
    static char* toolkittype;
    static char* toolkitoptions;
};

MPI_Comm IssmComm::comm;
bool IssmComm::parallel = false;
char* ToolkitOptions::toolkittype = nullptr;
char* ToolkitOptions::toolkitoptions = nullptr;
