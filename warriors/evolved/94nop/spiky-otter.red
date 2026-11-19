;redcode-94nop
;name Spiky Otter
;author 42evolve
;strategy evolved, warrior 751 of run seed 46, batch 39
;strategy 101.8 against 100 holdout warriors, 67.2 against the panel
;strategy from run i55-46, 17th November 2026, --pushoff value
        ORG     0
        SPL.AB  #-489, @3
        DJN.F   #1, <5
        DJN.F   #2, <5
        SUB.F   *-3148, >3084
        JMZ.I   }12, $1424
        DJN.F   #-1, <5
        SPL.AB  #-489, @-3
        JMN.F   @-11, >4
        SPL.AB  #-489, @-3
        DJN.F   #1, >5
