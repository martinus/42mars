;redcode
;name Echoing Viper
;author 42evolve
;strategy evolved, warrior 1268 of run seed 213, batch 79
;strategy 95.5 against 100 holdout warriors, 99.0 against the panel
;strategy from run tsda/island-13, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     0
        DJN.X   #-3, {0
        SPL.A   #1, #6
        SPL.A   #5, #5
        SPL.A   #1, #1
        MOV.I   *-107, <3
        SUB.X   $-3, {-8
        DJN.X   {6, {-6
        JMP.AB  @-5, <-14
        SEQ.X   #9, #12
        SNE.AB  $12, $-323
        JMP.A   #-10, <-14
        SEQ.B   *137, {-69
        CMP.B   $1, {1
        SEQ.B   $9, >12
        DJN.AB  #-193, {-12
        SEQ.B   *133, {365
        SPL.B   $4, {1
