;redcode
;name Followimp
;author FatalC
;strategy implike
;strategy redcoders frenzy r-12
;assert 1
org start
wimp:jmp #0
for 88
dat 0,0
rof
impgap equ 55
tailimp:mov impgap,impgap+1
headimp:mov -(impgap+1),-impgap
start:mov tailimp,start+321-impgap
mov headimp,start+321
spl wimp
spl 1
spl 1
spl 1
spl 2
jmp start+399-impgap,}0
jmp start+400,}0
end
