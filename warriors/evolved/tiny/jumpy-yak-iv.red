;redcode
;name Jumpy Yak IV
;author 42evolve
;strategy evolved, warrior 1645 of run seed 207, batch 99
;strategy 92.4 against 100 holdout warriors, 71.2 against the panel
;strategy from run ta/island-07, 18th November 2026, --pushoff pareto-age
        ORG     2
        SPL.A   {-3, >0
        SPL.B   #0, >0
        MOV.I   @22, {-74
        MUL.X   <-1, {341
        SPL.B   #0, >1
        DJN.BA  $-3, <34
        DJN.BA  $11, <153
        JMN.BA  #-29, >130
        JMN.I   #29, >1
        MUL.X   <8, {16
        SPL.B   #0, >0
        DJN.BA  $6, <153
        JMN.BA  #-29, >130
        DIV.BA  *-177, #5
        JMN.X   $7, @5
        DIV.BA  *-175, #5
        JMN.B   $3, #14
        MOV.I   }15, $-75
        JMN.F   *0, <-70
        SPL.AB  }4, #0
