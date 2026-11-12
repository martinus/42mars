;redcode-tiny
;name The Color of Core
;author Christian Schmidt
;strategy chaotic clear with post-replication
;strategy based on Terry Newtons SjHn (2/22/03)
;assert 1

xOff1   EQU    336
xOff2   EQU    163
xSep1   EQU    645
xSep2   EQU    303

pGo mov.i   >136,       {597
    spl.i   #382,       >249
    mov.i   #681,       <pGo
    mov.i   }297,       {0
    mov.i   <pGo,       <790
    spl.x   pGo,        <2
    mov.i   }-7,        }1
    djn.i   }158,       <151

start
i for 11
     mov.i  >xOff1+(i*xSep1), {xOff2+(i*xSep2)
rof
     djn.f   pGo,       {159

     end     start

