;redcode
;name Vengeful Squid XI
;author 42evolve
;strategy evolved, warrior 1715 of run seed 212, batch 99
;strategy 88.5 against 100 holdout warriors, 80.1 against the panel
;strategy from run tv/island-12, 18th November 2026, --pushoff value
        ORG     1
        MUL.AB  $-183, *217
        SPL.X   #280, >8
        DJN.X   #-5, {0
        SPL.X   {12, }294
        DIV.AB  #-13, >-128
        SPL.X   #-387, >10
        MUL.B   }16, {3
        SUB.I   @16, <-15
        SUB.I   @16, }-15
        SPL.X   {6, }294
        JMN.I   >-10, @1
        DIV.BA  @-7, @12
        SPL.X   {3, @67
        SPL.X   #-386, >2
        JMZ.A   >-11, *-1
        JMN.X   <-13, >-2
        SUB.I   {-1, >13
        CMP.AB  }326, }16
