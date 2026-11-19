;redcode-94nop
;name Wobbly Specter
;author 42evolve
;strategy evolved, warrior 418 of run seed 103, batch 19
;strategy 88.3 against 100 holdout warriors, 56.9 against the panel
;strategy from run islv/island-03, 18th November 2026, --pushoff value
        ORG     1
        CMP.F   <9, #-1825
        SPL.B   #-3825, <8
        DJN.X   #8, {8
        JMN.B   *-3, <-2
        NOP.A   @-1, $-18
        DJN.X   #8, {8
        SLT.F   @8, <-1
        SPL.AB  >9, }-2
        SUB.I   @-3203, {3
        DIV.I   <0, <-2
