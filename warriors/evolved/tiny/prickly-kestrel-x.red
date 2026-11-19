;redcode
;name Prickly Kestrel X
;author 42evolve
;strategy evolved, warrior 1718 of run seed 210, batch 99
;strategy 92.4 against 100 holdout warriors, 88.3 against the panel
;strategy from run tsc10/island-10, 18th November 2026, --pushoff pareto-sd --clear 10
        ORG     0
        SPL.B   #13, {349
        DJN.I   #3, <2
        DIV.X   }11, >-3
        SNE.F   >-91, $0
        SPL.BA  $0, @0
        SPL.I   *250, *12
        JMN.F   {-48, #-16
        JMP.BA  }4, *299
        JMP.BA  }3, @315
        JMZ.I   #3, }3
        SNE.A   >16, $-5
        DAT.BA  }2, *2
        MUL.B   @2, }372
        NOP.AB  >-160, @2
        JMZ.I   <-83, *27
        DJN.BA  @0, }-1
        SPL.BA  $0, @0
        SPL.AB  }0, @0
        JMP.BA  }8, *4
        MUL.BA  }0, @0
