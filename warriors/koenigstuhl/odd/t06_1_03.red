;redcode
;name     Move Along
;author   Philip Thorne
;strategy Down The Core And More [Nenad Tomasev 2006 R1]
;strategy
;strategy Summary: Move along, nothing new here
;strategy
;strategy   Switch-on-loss P-Spacer: 1-shot & stone (booted).
;strategy       Stone is QuickSilver based.
;strategy       1-Shot is LuckyLuke based.
;strategy       Switcher is from 'noideas' by Ilmari Karonen.
;strategy         [Really I had an idea for a 'brain' which is
;strategy          what motivated me for this round (adaptive
;strategy          alternative to NSFCWT 96 or Maniacs Rd 4, 98)
;strategy          but it's not ready/time's up.]
;strategy
;strategy   I expect imp's but they'll take longer to get going so
;strategy   are relatively less of a threat than usual to 1-shots.
;strategy   Hoping I don't meet CLP or any persistent brain-washer.
;       (CORESIZE==9240)
;assert 1

STEP    EQU (-2492)
ADJ     EQU (-1)

;Geist based
ptr     EQU (sptr-MAXLENGTH+1)

bptr:   dat     (eclr-ptr+3),   1
dptr:   spl     #(eclr-ptr+3),  ptr+350         ;B incr to shorten SPL
cycle
        dat     0,              0
incr:
clr:    spl     #STEP+1,        }STEP
        mov     @bptr,          }ptr
        mov     @bptr,          }ptr
eclr:   djn.f   -2,             >dptr

    for 10+8+4
        dat     0,              0
    rof

;===
; noideas pbrain [Ilmari Karonen].
;
; *** switch-on-loss p-brain ***
; 5 cycles on win/tie, 6 on loss

pflag   equ     3248            ; brainwashes to..
num     equ     2               ;

; pflag must not be the a-field of num-1 instructions after switch!

first:  ldp.ab  #pflag,     switch
        ldp.a   #0,         switch
        mod.ab  #num,       @first
switch  sne.a   >0,         0
        stp.ba  switch,     first
        djn.b   wB,         @first  ; asymmetric if num>2

;=== boot
BOOT    equ (-2532)                     ;Stone boot

wA
ddd for 5
        mov.i   <boot,      {boot
    rof
        mov.i   <sbmb+1,    BOOT+6     ;dangling ptr...
boot:   spl     BOOT,       stone+5
        mul.x   {0,         }0
        dat     0,          0

    for 3
        dat     0,          0
    rof

; Quicksilver stone adjusted for 9240

INCR    EQU (794)
INIT    EQU (-3041)
DOFF    EQU (2813)-1
BVAL    EQU (3039)

stone:  SPL.B  #     0, $     0
        MOV.I  $     9, @     2
        ADD.AB #  INCR, $     1
        MOV.I  $     7, } INIT
        DJN.F  $    -3, <  DOFF

    for 5
        dat     0,          0
    rof
sbmb:   DAT.F  $  BVAL,    >1

    for (MAXLENGTH-CURLINE-12)
        dat     0,              0
    rof
;===

;find
scan:   add.ab      #STEP+ADJ,  sptr
wB:     jmz.f       scan,       >sptr
sptr:   spl         clr,        scan+STEP
        mov.ba      sptr,       ptr
        mov.i       {jbmb+1,    <sptr

    for 4
        dat     0,              0
    rof

jbmb:   jmp     #0,             0

end first

