;redcode-94
;name Origami
;author 42mars sample
;strategy Paper: eight processes copy the two-line body to a new place, split
;strategy into the copy and start over there. Each copy bombs while it works.
;assert CORESIZE == 8000
dist    equ     2341

        spl     1
        spl     1
        spl     1
silk    spl     @0,     }dist
        mov.i   }silk,  >silk
        mov.i   bomb,   >1773
        mov.i   bomb,   }1213
        jmp     silk,   {silk
bomb    dat     >2667,  >5334
        end
