;redcode-94x
;name LV Paper
;author John Metcalf
;strategy poor paper
;strategy Redcoders' Frenzy Limited-Value Round
;assert 1
; CORESIZE==55440


    spl   2
    spl   1
    spl   1,     }1

    mul.a #1,    1

    spl   1,     0
    mov   >-1,   }-1
    spl   #0,    0
    mov   @1,    <-1
    djn.f -1,    }1
    dat   1,     1
