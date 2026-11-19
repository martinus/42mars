;redcode
;name Silver Koala VI
;author 42evolve
;strategy evolved, warrior 1529 of run seed 215, batch 89
;strategy 96.6 against 100 holdout warriors, 102.0 against the panel
;strategy from run ta/island-15, 18th November 2026, --pushoff pareto-age
        ORG     0
        DJN.X   #14, <1
        SPL.F   #-4, <-11
        SPL.X   #-79, $-309
        SPL.B   #-1, {0
        MOV.I   *101, {2
        SUB.X   #7, <0
        JMN.B   >158, *10
        MOV.F   #-4, <11
        JMZ.AB  $2, <2
        SPL.F   #185, <-309
        JMN.B   @-10, @-1
        SPL.B   {-160, {0
        SPL.I   <358, {390
        SPL.BA  {-257, {0
        CMP.AB  {340, #10
        MOV.B   {2, >-148
        MOV.X   @1, @6
        SUB.AB  {-1, <-12
        NOP.F   >93, {13
        SEQ.BA  #79, <-309
