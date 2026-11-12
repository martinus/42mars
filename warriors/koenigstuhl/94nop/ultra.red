;redcode-94m
;name Ultra
;author Ken Espiritu
;strategy 2-level Silk Spawn/DJN Stream/Core Clear
;strategy Has the spawner from RetroQ with additions
;assert CORESIZE==8000

spcsz   equ 3242        ;3242-1622pts;2936-1590 pts;1883pts
impsz   equ (212*23)

start   spl   1, >3234
        mov.i -1,#0
        spl   1 , {4226
        mov   <1,{1             ; make another copy and start him
        spl   4000+7,7          ;   safer than going back to RetinA
d0      spl   @0,spcsz          ; two-level silk spawner
        mov   }d0,>d0
e0      spl   @0,impsz
        mov   }e0,>e0
        spl   e0,{e0            ; loop and split
        mov.i #2*spcsz,}-spcsz*1
        mov.i #2*spcsz,}-spcsz*1
        mov.i #2*impsz,}-impsz*1
        djn e0, <-spcsz
        spl 0, <5673
        mov <-2,<-2
        end start

