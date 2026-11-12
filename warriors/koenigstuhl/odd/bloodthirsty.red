;redcode-94
;name Blood Thirsty v1.0
;author Kiv
;strategy .5c vamp engine
;assert CORESIZE==8000 || CORESIZE==800 || CORESIZE==55440

    ORG    boot

    FOR    CORESIZE == 55440
const    EQU    11781
    ROF
    FOR    CORESIZE == 8000
const    EQU    34
    ROF
    FOR    CORESIZE == 800
const    EQU    17
    ROF

bootptr    DAT    dBmb,    200
boot    MOV    }bootptr,    >bootptr
    MOV    }bootptr,    >bootptr
    MOV    }bootptr,    >bootptr
    DJN    boot+1,    #3

    ADD.AB    #36,    bootptr

    MOV    }bootptr,    >bootptr
    MOV    }bootptr,    >bootptr

    ADD.AB    #24,    bootptr

    MOV    }bootptr,    >bootptr
    DJN    -1,    #4
    JMP    boot+201

dBmb    DAT    <2667,    0
sBmb    SPL    #dBmb-(ptr+60),    #dBmb-(ptr+59)
shell    SPL    #const,    #-const
go    ADD    shell,    fang+36
    MOV    fang+36,    @fang+36
    MOV    dBmb,    *fang+36
    DJN    go,    <dBmb-94

fang    SPL    @pitptr,    0
pitptr    DAT    0,    pit+24

    SPL    1
pit    MOV    *ptr,    <ptr
    DJN    pit-1,    <7000
ptr    DAT    sBmb-60,    dBmb-60