;redcode-94nop
;name Kinetic Werewolf XLII
;author 42evolve
;strategy evolved, warrior 7677 of run seed 84, batch 479
;strategy 94.6 against 100 holdout warriors, 113.9 against the panel
;strategy from run cmp-p2-84, 18th November 2026, --pushoff pareto
        ORG     17
        MOV.I   #3862, $6
        DJN.X   {-9, $16
        SNE.A   >17, $6
        JMN.BA  #7, *0
        JMN.BA  #7, *0
        DJN.A   >12, >-1882
        CMP.A   <10, *0
        DJN.X   #1244, }-1
        DIV.BA  {-2551, {9
        SPL.A   #11, >-2595
        MOV.I   #-634, $1140
        ADD.X   {7, @5
        DIV.I   <-2561, #-2
        MOV.F   #-5, @-13
        JMZ.B   #3474, {-5
        MOV.I   $12, {-11
        DAT.F   *-2937, {2241
        MOV.I   $-9, }-3064
        JMZ.BA  >2285, @-16
        SPL.I   #-3963, {2
        MOV.I   *-5, {-18
        DIV.I   {-2941, {0
