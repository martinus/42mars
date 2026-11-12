;redcode-8
;name paper 88
;author bjoern guenzel
;strategy paper for '88 style low process multiwarrior challenge
;strategy KOFACOTO round 2
;strategy probably doesn't even work properly...
;assert 1

dist  equ (8*777)
off   equ (8*7)

src mov #dest+1,$dest+1 
 add #off,dest 
cloop mov <src,<dest
 jmn cloop,src
 spl src,0
dest jmp @0,#dist

 end cloop
