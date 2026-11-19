;redcode-94nop
;name Recursive Tardigrade IV
;author 42evolve
;strategy evolved, warrior 718 of run seed 1, batch 39
;strategy 91.9 against 100 holdout warriors, 66.5 against the panel
;strategy from run n1, 15th November 2026, --pushoff value
        ORG     2
        DAT.BA  #4, <7
        MOD.I   *13, <1426
        SPL.I   #-1456, <8
        DJN.X   #-1, <-2
        CMP.B   }2, #13
        SEQ.I   *7, }2
        MUL.BA  *-13, <-13
        SEQ.AB  {14, *9
        DJN.X   #-1, <-7
        CMP.B   }-3, #13
        SEQ.I   *2, }2
        SEQ.X   *-9, #1031
        DJN.X   #-1, <-11
        DJN.AB  >-13, >6
        SPL.I   #-1456, <8
        SNE.I   >-8, @14
        JMZ.AB  }8, >-6
        SLT.B   $-1816, <-783
        DJN.BA  >2155, {2940
        JMZ.F   *-7, {-1
        DJN.AB  >-13, >6
        SPL.BA  }-20, #-8
        SEQ.I   {-1, *9
