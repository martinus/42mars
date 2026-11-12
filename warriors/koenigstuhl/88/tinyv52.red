;redcode verbose
;name Tiny v.52
;author Paul S. Kilroy
;strategy I dont know how original this is... but it is basically stone
;strategy with coreclear.
;strategy     v.52  -  Different system..
;assert CORESIZE==8000

inc        add off, move
move        mov <4000+1, -184+1+4
        djn inc, #2000
off        mov -184, <-184
        jmp -1, <-10
