;redcode-94nop
;name Wobbly Zombie
;author 42evolve
;strategy evolved, warrior 3577 of run seed 55, batch 219
;strategy 111.2 against 100 holdout warriors, 101.9 against the panel
;strategy from run i20-55, 17th November 2026, --pushoff value
        ORG     2
        MOV.I   @1, <-1
        MOV.I   @1, <-5
        SPL.AB  $0, @0
        DJN.I   *0, >2
        SEQ.B   $12, <12
        DJN.BA  >-1, >495
