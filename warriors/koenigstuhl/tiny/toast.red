;redcode-tn
;name toast
;author John Metcalf
;strategy oneshot
;assert 1

     org   ptr

gate:dat   25,       25+scan/2
bptr:dat   9,        1
clr: spl   #10,      400
loop:mov   @bptr,    }gate
     mov   @bptr,    }gate
     djn.f loop,     >clr

     for   10
     dat   0,0
     rof

scan sub   ptr,      gate
ptr  sne   *gate,    @gate
     djn.f scan,     <-169
     djn.f clr,      gate
     end

