
;redcode-94
;name Aminos
;author F.Z.
;strategy Boot, Stun, then Clear
;assert CORESIZE == 8000

bootp    EQU    2650
bstep    EQU    2005
bstrt    EQU    6+bstep
btime    EQU    300

    ORG    Scan1

Scan2    SEQ.I    $-1        ,@Bdata
    ADD.AB    #9-bstrt    ,$-1
Boot    for    11
    MOV.I    {Bdata        ,<Bdata
    rof
    SPL.B    @Bdata        ,#0
    MOV.I    $2        ,$1
Bdata    DAT.F    #Core+11    ,#bootp
Apart    for    72
    DAT.F    #0        ,#0
    rof
Scan1    JMZ.F    $Scan2        ,@1
Core    MOV.I    $Part2        ,$bstrt
    MOV.I    $Part1        ,<-1
    ADD.AB    #bstep+1    ,$-2
Part2    DJN.B    @-1        ,#btime
    JMP.B    Clr-1        ,3
Part1    SPL.B    #Core-4        ,#0
    DAT.F    $-100        ,$9
Bb    SPL.B    #-500        ,$11
Clr    MOV.I    @2        ,>-5
        MOV.I    @1        ,>-6
    DJN.F    $Clr        ,{Bb

    END

