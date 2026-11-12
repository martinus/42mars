;redcode-94nop
;name Iron Curtain
;author Ken Espiritu
;strategy .8c sne/seq scanner with .75c spl/dat carpeting
;assert 1

org     loc
dist    equ 541     	;mod-1,3,5,8,13/3061,1183,695,488,207
n 	equ 3061        ;delay self scan as long as possible
d 	equ 7
;dist    equ     2199   ;mod-1,4,7,11/2201,804,593,211
;n equ 2200
;dist    equ     1053   ;mod-1,4,5,9,14/1717,1132,585,547,38
;n equ 2000
;dist    equ     1847   ;mod-1,4,7,11/2183,732,719,13
;n equ 2182
;dist    equ     2947   ;mod-1,3,4,7/1151,2283,772,649
;n equ 2282
;dist    equ     2103
;n equ 2232
;dist    equ     1847
;n equ 2182
;dist    equ     1671
;n equ 2230
scan    equ     dist*2
safe    equ     (pend-top+4)
gate    equ     (first-5)
;               A+A*2, A*2
;                        X
;               A+A*2+A, A*2+A
;                        X
;               A+A*2+A+A, A*2+A+A
;              =A+A*2+A*2, A*2+A*2
;               A+A*2+A*2, A*2+A*2
top     sub     step,    @lloc
loc     sne.f   dist+scan+d, scan+d
        sub     step,    @lloc
lloc    seq.f   *loc,   @loc
        slt     #safe,  @lloc
        djn     *ttop,  cnt
        mov.b @lloc, loc-2
switch  mov bomb, <loc-2
        mov >loc-2, >loc-2
        mov *switch, >loc-2
        jmn.f switch, >loc-2
        sub   offset, @lloc
cnt     jmn.b @lloc, #n
ttop    jmp top, }switch
offset  dat -dist, -dist
step    dat -scan, -scan
bomb    spl #0,{0
pend    dat 0,{0
        dat 0,{0

