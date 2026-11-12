;redcode-94x verbose
;name Tri Warrior 2 (10 lines)
;author Simon Duff
;assert 1

        spl     1,      }-100   ; 1 proc  execs this line
        spl     1,      >-100   ; 2 procs exec this line
        spl     1,      <-100   ; 4 procs exec this line

p1:     spl     @0,     311     ; done
        mov.i   }-1,    >-1     ; done
p2:     spl     @0,     87      ; done
        mov.i   }-1,    >-1     ; done
        mov     2,      }0      ; done
        mov     }-1,    }-1     ; done
