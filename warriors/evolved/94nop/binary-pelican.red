;redcode-94nop
;name Binary Pelican
;author 42evolve
;strategy evolved, warrior 9048 of run seed 1, batch 559
;strategy 90.0 against 100 holdout warriors, 78.2 against the panel
;strategy from run sp1, 15th November 2026, --pushoff value
        ORG     0
        SPL.B   #3103, >3
        MOV.I   @-3, $4
        SUB.F   @-2, >-3007
        SUB.AB  <1136, >5
        DJN.F   #3704, }3
        SUB.X   }3, #-2
        MOV.A   #-12, @7
        JMN.B   *605, #-5
        MOD.AB  <-4, @-2
