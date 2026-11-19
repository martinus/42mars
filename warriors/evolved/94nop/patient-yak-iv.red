;redcode-94nop
;name Patient Yak IV
;author 42evolve
;strategy evolved, warrior 592 of run seed 50, batch 29
;strategy 74.6 against 100 holdout warriors, 74.5 against the panel
;strategy from run i20-50, 17th November 2026, --pushoff value
        ORG     1
        MOV.B   @3, {2772
        DJN.F   #-5, >3
        SNE.F   #12, <15
        JMN.F   }-8, {3
        MOV.B   @3, {2772
        SPL.A   #11, {3
        SPL.AB  <-1, *12
        SEQ.X   #13, <-1
        SPL.A   *7, {3
        SPL.AB  <-349, *12
        MOV.X   *-2021, {1
        ADD.B   }-5, }-5
        ADD.F   @-8, }2564
        SPL.I   >-9, @-9
        SEQ.AB  @-6, @-2
        MOD.A   }-8, $2
        MOD.A   }-3, {2
