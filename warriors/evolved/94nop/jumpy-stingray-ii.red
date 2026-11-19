;redcode-94nop
;name Jumpy Stingray II
;author 42evolve
;strategy evolved, warrior 755 of run seed 46, batch 39
;strategy 83.7 against 100 holdout warriors, 70.0 against the panel
;strategy from run i20-46, 17th November 2026, --pushoff value
        ORG     0
        DJN.F   #-1828, }7
        DJN.F   #-1828, }6
        SUB.I   #7, @2
        DJN.F   #-1828, }4
        SUB.I   #5, @2
        SEQ.F   {2, >11
        JMN.X   <149, >4
        SEQ.A   $2854, @12
        DJN.BA  >-1, @-9
        SEQ.F   {-2, >11
        DAT.F   <-10, {-3
