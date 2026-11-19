;redcode-94nop
;name Jagged Mosquito VII
;author 42evolve
;strategy evolved, warrior 1409 of run seed 1, batch 79
;strategy 86.3 against 100 holdout warriors, 121.1 against the panel
;strategy from run a, 14th November 2026, --pushoff value
        ORG     1
        SLT.A   #6, $7
        SPL.A   #14, <-13
        CMP.A   #1, <2
        DJN.I   #-1456, <1
        JMZ.X   <15, }-2335
        SEQ.A   *6, $-1
        SPL.AB  #4, <-9
        SPL.B   #-1, <-9
        MOV.I   @-9, <-1
        SPL.B   $6, <-7
        JMP.AB  {1, *-3418
        MUL.X   }-13, <0
        CMP.BA  >-9, #3
        DIV.BA  $1650, {-13
        SNE.B   #2095, #-12
        DJN.A   #-1456, <3179
