;redcode
;name Wing Man 2
;author Chip Wendell
;strategy Entry for Redcoder's Frenzy 17
;strategy Find little sibling, capture him,
;strategy   and both blast away at bully
;strategy   in a modified version of Recon 2
;assert 1

dat1    dat        -1,     0
top     add.ab     #129,   wptr
start   jmn.a      check,  @wptr
        jmz.a      top,	   <wptr
check   seq.i      dat1,   @wptr    ; check for decrement trail
delta   jmp        top,    #64

found   jmz.a      is0,    @wptr    ; found the trail! search for beginning
        sub.b      delta,  wptr
bomb    jmp        narrow
is0     add.b      delta,  wptr
narrow  div        #2,     delta    ; binary search
        djn.b      found,  #6

gotcha  sub        #1599,  wptr     ; adjust pointer to little sibling
        sub.ba     wptr,   bomb     ; adjust the vamp bomb
        mov        bomb,   @wptr    ; come join me, LS
wptr    jmp        scan,   #324     ; go to scan portion of Recon 2

;Modified Recon 2
step equ 6557   ; overcomes 3, 7, 9, and 11 point imps
ptr equ (scan-7)
        dat        19,     19
diff    spl        #-step, #-step   ; LS runs the bomb portion of Recon 2
wipe    mov        diff,   >ptr     ; hit 'em with SPLs
w2      mov        *wipe,  >ptr     ; later, this becomes a DAT clear
        jmp        wipe             ; no need to fall through; LS works
alone

loop    sub        diff,   @s2
scan    sne        (step*2) - 1, (step*2) - 7   ; check a pair
        sub        diff,   scan
s2      seq        *scan,  @scan    ; check another pair
        slt.a      #20,    scan     ; ignore self
timer   djn        loop,   #7999    ; count down to DAT phase

tweak   mov.ab     @s2,    @wipe    ; redirect aim of LS stun gun
t2      jmn        loop,   timer    ; when timer expires,
        djn.a      <tweak, wipe     ; join LS for DAT clear mode

        end        start
