;redcode-94
;name S A S
;author Robert Macrae
;assert CORESIZE == 8000
;strategy Rescue CIA

; QS for CIA boot code, vamp it, and then scan for Jedimp.
; Finding a CIA bomb is much more compact, but dies a little
; more because it takes 150 cycles or so to find that first
; bomb.

        org     start

; QS Constants
bigst   equ     100
qstart  equ     start+100
qst     equ     qstart -(4*bigst)

; SAS constants
step     equ 190				      ; mod-10 for Mod-5 scan
BombCopy equ (Scan-1)
gate     equ cPtr 
cPtr     equ Hijack

test    dat     0,    0                   ; Find CIA start
scale   dat     #17,  #11                 ; 
found   jmp     Debrief, 0                ; Fang for CIA head

; ------------------------------------------------------
; QS 79 locations. Guaranteed to find something...

start   

  s1 for 5
        sne.i   qst+4*bigst*s1, qst+4*bigst*s1+bigst*1
        seq.i   qst+4*bigst*s1+bigst*2, qst+4*bigst*s1+bigst*3
        mov.ab  #qst+4*bigst*s1-found, found  
     rof
        jmn  which,   found
  s2 for 5
        sne.i   qst+4*bigst*(s2+5), qst+4*bigst*(s2+5)+bigst*1
        seq.i   qst+4*bigst*(s2+5)+bigst*2, qst+4*bigst*(s2+5)+bigst*3
        mov.ab  #qst+4*bigst*(s2+5)-found, found
     rof
        jmn  which,   found
  s3 for 5
        sne.i qst+4*bigst*(s3+10), qst+4*bigst*(s3+10)+bigst*1
        seq.i qst+4*bigst*(s3+10)+bigst*2, qst+4*bigst*(s3+10)+bigst*3
        mov.ab  #qst+4*bigst*(s3+10)-found, found
     rof
        jmn.b   which, found
lasttry
  s4 for 4
        sne.i qst+4*bigst*(s4+15), qst+4*bigst*(s4+15)+bigst*1
        seq.i qst+4*bigst*(s4+15)+bigst*2, qst+4*bigst*(s4+15)+bigst*3
        mov.ab  #qst+4*bigst*(s4+15)-bigst-found, found
     rof
        sne.i qst+4*bigst*(5+15), qst+4*bigst*(5+15)+bigst*1
        seq.i qst+4*bigst*(5+15)+bigst*2, qst+4*bigst*(5+15)+bigst*1
        mov.ab  #qst+4*bigst*(5+15)-bigst-found, found

        add     #bigst,  found     
which   jmz.f   -1,      @found    ; Identify the hit
        mov.i   @found,  test
        mod.f   scale,   test  
        jmn.f   finds,   test      ; Have I found the trailing SPLs?
        div.f   scale,   @found
        sub.b   @found,  found
        sub.ab  #29,     found
finds   jmn.f   #0,      <found    ; Find first word
        add.ab  #2521,   found     ; And find CIA.
					     
; Check this is really CIA...
        jmn.f   Hijack,  @found
        mov.ab  #0,      found
        jmp     lasttry     

; Subvert station head and mop up
 
Hijack  sub.ba  found,    @-2            
        mov.i   found,    >found           
        mov     hit,      >found            ; Friendly fire
        djn     -1,       #6                ; "Pour encourager l'autre"

; 0.66c scanner with CIA handling the carpet.

scan    seq.i   hit+3*step-6, hit+3*step-10
chg     mov.b   scan,	  @Debrief
a       add.f   inc,	  scan
        djn.b   scan,	  #795
        jmp     clear,     {0

; Co-operative pair of clears, linear and spiral.

bPtr    dat     spb,      clear+5
db      dat     #db-bPtr,  #found+2-cPtr  

clear   mov     *bPtr,     >bPtr
	  add     #381-2,    bPtr              ; 0.33c spiral clear
        jmp     clear,     >bPtr
Debrief mov     *bPtr,     >cPtr             ; 0.5c carpet
        jmp     Debrief,   }cPtr            

hit     dat     0,        0

spb     spl     #db-bPtr,  #clear+20-cPtr
inc     spl     #step,     #step

        end
