;redcode-DS
;name Placeholder
;author Michal Janeczek
;strategy paper with stone
;strategy Hullab3loo without qscan and paper boot
;assert 1

step equ 17
dbofs equ 7741
sdist equ 4292

top spl #0 , 6
mov top+dbofs , @2
tgt add #step*2 , 1
mov top+dbofs , }tgt-step*7485
djn.f -3 , {2926
dat 0 , 0

db dat step , >1

start mov db , pap+sdist+dbofs
spl 2
spl 1
spl 1

mov <top , {sboot
spl *sboot
sboot spl pap+sdist+6

pap spl 561 , {src
mov }src , }pap
mov pbomb , >7157
src mov pbomb+1 , }pap
jmz.f pap , *src
pbomb dat <5334 , <2667

end start