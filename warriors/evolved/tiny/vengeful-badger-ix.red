;redcode
;name Vengeful Badger IX
;author 42evolve
;strategy evolved, warrior 1058 of run seed 207, batch 59
;strategy 94.5 against 100 holdout warriors, 74.7 against the panel
;strategy from run tv/island-07, 18th November 2026, --pushoff value
        ORG     0
        SPL.BA  #13, @-12
        DJN.X   #284, <2
        JMZ.X   $-7, }10
        DAT.I   >10, $-270
        SEQ.AB  #0, }5
        MUL.F   <0, {8
        SPL.I   {10, $5
        SLT.BA  $140, *6
        JMP.A   }-10, $-12
        MOV.A   $-14, }3
        MUL.BA  $-10, $-267
        SEQ.B   }3, $3
        DIV.BA  $4, {-132
        SEQ.X   }16, <19
        MOV.I   *203, #1
