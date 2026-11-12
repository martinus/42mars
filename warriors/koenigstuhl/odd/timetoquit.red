;redcode-94
;name TimeToQuitCoding
;author Roy van Rijn
;assert 1
gate:
dat 23, 24
ptr:
dat 4,3
for 10
dat 0,0
rof
clear:
spl   #0,0 
mov   bmb, @gate 
mov   bmb, *gate
add.f ptr, gate
djn.f -2,  gate 
bmb: 
dat 2, 2-gate 
end clear