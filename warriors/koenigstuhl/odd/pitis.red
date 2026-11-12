;redcode-nano
;name p it is
;author hwm
;strategy nano p warrior
;strategy for the hell of it
;assert 1
;       CORESIZE==80
; Note by CCB: Pspace and Nano don't mix

        init equ 234
start
result: ldp.b 1,#0
prev:   jmz.f init,>result
        mod.a   }2,       } start
tie     jmz.ba #10,     }6
imp     mov.i #1,       1
end

