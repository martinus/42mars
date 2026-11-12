;redcode-94
;author John Metcalf
;strategy Neogryzor's Mini Challenge #04
;strategy 73.5% three way ties plus big bonus ;-)
;assert 1

; find a bomb and trace the trail of
; bombs right back to the stone

less:jmz.f  #0,         >ptr
find:sub    #17*5,      ptr
     jmz.f  find,       @ptr

; modify stone's jmp to vamp stone
; into our clear

     sub.ba ptr,        @ptr

; wipe core to stun oneshot

clr: mov    ptr,        {ptr
     djn.f  clr,        {ptr
     dat    0,          0
ptr: jmp    #less-666,  less-1995

     end  less

