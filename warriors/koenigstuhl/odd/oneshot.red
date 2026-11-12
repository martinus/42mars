;redcode-94
;name Oneshot
;author Roy van Rijn
;assert 1
gate dat 123, 4124
ptr dat 2,1
for 4
dat 0,0
rof
clear spl   #0,0
mov   bmb, @gate 
mov   bmb, *gate
add.f ptr, gate
djn.f -2,  gate
for 4
dat 0,0
rof
bmb
sAdd
dat 10,10
sOne    add.f   sAdd,        gate
        sne.i   *gate,       @gate
        djn.f   sOne,        @gate
        djn.f   clear,       *gate
end sOne

