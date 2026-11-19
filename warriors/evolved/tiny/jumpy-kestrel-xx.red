;redcode
;name Jumpy Kestrel XX
;author 42evolve
;strategy evolved, warrior 1662 of run seed 210, batch 99
;strategy 96.1 against 100 holdout warriors, 91.1 against the panel
;strategy from run tsd/island-10, 18th November 2026, --pushoff pareto-sd
        ORG     0
        SPL.X   #3, >-391
        DJN.I   #-11, <1
        SUB.AB  *-108, <-60
        SPL.BA  $0, $0
        JMP.AB  {2, {372
        MOV.X   #-4, @215
        SPL.AB  <7, @-13
        JMN.I   *-48, #16
        DJN.F   #2, <1
        MOV.AB  *-108, <-60
        ADD.BA  >-116, >6
        ADD.B   {16, #0
        JMN.AB  *-48, #16
        SEQ.AB  >15, #13
        SLT.B   #7, *15
        MUL.I   <-229, *2
        MOD.I   <-5, $-12
        DAT.I   <-4, $2
        ADD.AB  @2, {372
        DAT.B   $-228, #-8
