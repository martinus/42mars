;redcode
;name LamerBomb
;author Sascha Zapf
;First entry IRCT11
;assert 1

;In this round you have to compose a warrior using just six instructions
;from ICWS'88 mode:

;MOV ADD JMP SPL CMP DAT

;Also, you are limited to three addressing modes: #, $ and @.

;All warriors would fight in a round-robin, with self-fights, using pmars
;with options

;-8 -s 8192 -l 100 -p 64 -c 100000

bomb    spl     $0
        add     #3576,  ptr
ptr     mov     bomb,   self+3576
self    dat     #0
        spl     $0
        mov     ccb,    @pos
        add     #-1,    pos
ccb     dat     #0,     #self-1
pos     dat     #0,     #self
for     20
        dat     #0,#0
rof
qbomb
l       for 70
        mov     bomb,$100+l*(8000/70)
        rof
        jmp     bomb

        end qbomb
