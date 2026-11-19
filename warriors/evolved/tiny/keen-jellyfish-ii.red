;redcode
;name Keen Jellyfish II
;author 42evolve
;strategy evolved, warrior 418 of run seed 212, batch 19
;strategy 96.1 against 100 holdout warriors, 76.2 against the panel
;strategy from run tsd/island-12, 18th November 2026, --pushoff pareto-sd
        ORG     0
        SPL.F   #1, $3
        DJN.I   #-339, <2
        DIV.I   $-16, $320
        SEQ.BA  <-3, $0
        SPL.F   #1, $3
        DJN.I   #-339, <2
        DIV.I   $-16, $320
        JMN.F   @-3, >-7
        SEQ.BA  <-4, $-1
