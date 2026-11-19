;redcode
;name Mad Squid V
;author 42evolve
;strategy evolved, warrior 743 of run seed 201, batch 39
;strategy 86.6 against 100 holdout warriors, 90.6 against the panel
;strategy from run tsda/island-01, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     0
        SPL.X   #3, >3
        DJN.I   #-3, <-5
        MUL.BA  }0, $5
        SPL.X   #6, >-3
        SPL.X   #5, >7
        SPL.X   #10, >-3
        JMP.BA  >-2, <182
        MUL.X   {12, {1
        SNE.A   >-18, *-16
        SEQ.F   }72, @-10
        CMP.A   $229, <-7
        JMZ.A   }72, @10
        SPL.B   #-370, >-1
        SEQ.AB  >-1, @-5
        DJN.X   #-3, <-5
        MUL.BA  }0, $5
        SPL.X   #10, >-3
        JMP.BA  >-2, <182
        MUL.X   {1, {1
        SPL.I   #-370, >-1
