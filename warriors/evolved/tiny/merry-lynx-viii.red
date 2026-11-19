;redcode
;name Merry Lynx VIII
;author 42evolve
;strategy evolved, warrior 1701 of run seed 215, batch 99
;strategy 83.6 against 100 holdout warriors, 69.2 against the panel
;strategy from run tsda/island-15, 18th November 2026, --pushoff pareto-sd --difference ahead
        ORG     0
        SPL.I   #-6, $14
        DJN.I   #-3, >4
        SPL.A   #13, }16
        JMP.A   }-362, >4
        MOV.BA  $14, $9
        ADD.I   $-228, *10
        SPL.A   #13, @32
        JMP.A   <-362, {5
        SNE.X   @6, $-64
        DJN.B   #97, >2
        NOP.A   #-15, <-4
        ADD.F   $-60, *5
        DIV.AB  $3, }3
        DJN.F   <0, *-53
        JMN.I   >12, #0
        SPL.I   $4, @4
        MOD.X   {-3, }-2
        DJN.F   <0, *-53
        MUL.B   >-2, #-2
        SNE.X   }-4, >-5
