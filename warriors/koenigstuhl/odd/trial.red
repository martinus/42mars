;redcode-94x verbose
;name trial-by-fire
;author Simon Duff
;strategy paper
;assert 1

for 0
        Not sure if P-space was allowed this round. Would be a great place to
        store a large value between rounds (ie, calculate a large value in
        first round, save it in P-space, saves on having to recalculate).
        Well, if someone decides to use this strategy, hopefully my small
        brain washing line will cause small havoc.

        Other than this, nothing to exciting about this paper. Lays down a
        short dat }1, >1 stream often, and doesn't perform too badly against
        some scanners and papers from the 94x infinite hill. Although it got
        badly thrashed by the current 94x hill on koth :)
rof


        spl     1,      0       ; 1 proc  execs this line
        
        spl     1,      }1      ; 2 procs exec this line
        nop     >1,     >1      ; 4 procs exec this line: nop >3, >1

        spl     1,      }-1     ; 4 procs exec this line: spl  1, }3
        nop     {1,     {1      ; 8 procs exec this line: nop {1, {1
        
        mul.ab  #-1,    0       ; mul.ab #?, 4
        mul.ab  #1,     1       ; mul.ab #?, 1

p1:     spl     @0,     1       ; done
        mov.i   }-1,    >-1     ; done
p2:     spl     @0,     1       ; done
        mov.i   }-1,    >-1     ; done
        stp.ab  #0,     }0      ; done: damage warriors storing large # in P 
        mov.i   1,      }-1     ; done
db:     dat     }1,     >1      ; done
        dat     }1,     >1      ; done
        dat     }1,     >1      ; done
        dat     }1,     >1      ; done

