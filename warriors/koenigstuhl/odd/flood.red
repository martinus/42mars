;redcode-94
;name The Flood
;author Kiv
;assert CORESIZE==8000 || CORESIZE==800 || CORESIZE==55440

        ORG pGo
pStep1    EQU    1341
pStep2    EQU    3421
pStep3    EQU    5001
pStep4    EQU    7081

pGo    SPL    1,    {400
    MOV    -1,    0
    SPL    1
    SPL    1

fsilk1    SPL    pStep1
    MOV    >fsilk1,    }fsilk1

fsilk2    SPL    pStep2
    MOV    >fsilk2,    }fsilk2

fsilk3    SPL    pStep3
    MOV    >fsilk3,    }fsilk3

    MOV    bsilk+1,    <-100
    MOV    bsilk+1,    <-200

    SPL    1
    MOV    2,    <-1
bsilk    DJN    -2,    <-2
    DAT    <2667,    <-2667


g        FOR    MAXLENGTH-CURLINE
    DAT    #g,    #-g
        ROF
