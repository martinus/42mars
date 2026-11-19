;redcode-94nop
;name Nimble Mosquito
;author 42evolve
;strategy evolved, warrior 608 of run seed 1, batch 29
;strategy 80.3 against 100 holdout warriors, 107.5 against the panel
;strategy from run alpha2, 14th November 2026, --pushoff value
        ORG     0
        SPL.B   #10, <-9
        SEQ.A   *6, $-1
        SPL.B   #8, <-9
        DJN.X   #3, <-265
        JMP.B   <15, }-2071
        SLT.F   <11, {3
        SLT.F   <11, *-2
        DJN.F   {13, >-9
        SEQ.A   *6, $-6
        SNE.A   #-15, $0
        NOP.I   *16, #11
        DIV.F   <-10, @-2
        SLT.A   @2185, $7
        DAT.BA  $-2805, {0
        DJN.X   {1402, {0
        JMZ.BA  #4, $3
        SPL.I   #-1456, <8
        SPL.X   }-12, >3
        DJN.X   #3, <-265
        JMP.AB  >-5, @-12
        SLT.I   <-4, {-2747
        NOP.B   >1, <-10
        ADD.F   *-6, #-2176
