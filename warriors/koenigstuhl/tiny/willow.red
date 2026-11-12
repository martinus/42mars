;redcode-tiny
;name Will-o'-the-Wisp
;author John Metcalf
;strategy qscan -> paper/imp
;assert CORESIZE==800

        qx    equ 504
        qy    equ 701

        sne.x  qf+((qx-1)*qy+1)*(((qx-1)*qy)%800), qf+(qx-1)*qy
        seq.x  qf+(qx*qy+1)*((qx*qy)%800),         }qf
        jmp    @qlo+1,                             {qf
        sne.x  qf+((qx+1)*qy+1)*(((qx+1)*qy)%800), qf+(qx+1)*qy
        jmz.f  pgo,                                <qf

qf      mul.x  #qx,      #qy
        jmz.f  @qlo+1,   >qf

qlo     mov    }519,     >qf
        mov    }qlo,     {qf
        seq    {qf,      >qf
        djn.f  qlo,      >qf

        step1  equ 325
        step2  equ istep+1
        istep  equ 267

pgo     spl    2,        <100
        spl    1,        <200
        spl    1,        <300

papera  spl    @0,       }step1
        mov    }papera,  >papera
paperb  spl    @0,       }step2
        mov    }paperb,  >paperb
        mov.i  #1,       {1
imp     mov.i  #75,      istep

        end
