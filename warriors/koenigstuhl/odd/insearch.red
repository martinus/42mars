;name In Search of Efficient Code (7)
;strategy Triad of mutually repairing scanners intended --
;strategy but not guaranteed -- to crush everything that
;strategy does not use SPL bombs or imps.
;author Robert Macrae
;assert 1
;       CORESIZE == 55440
;       MAXPROCESSES == 8

; Ins8 doubles rate of self check.

; Ins7 revises life check so only one process can lurk, => 5 8 7.
; Better, but still too sensitive. Have to trace in detail...

; Ins6 Result *incredibly* sensitive to life check delay,
; EG 20 => 7 7 6, 40 => 6 4 10. What is going on? Perhaps several
; processes are lurking in check code?

; Better to revive BOTH partners or check only 1? Both might
; need a lock so to prevent 2 proc entering on simultaneous
; check... Should calculate the minimum acceptable life check.
; Mechanism seems to work, though less efficiently than I hoped.
; Is rescanning a problem? Move to different steps?

; Ins6: tries unequal steps.
; 269,283 used without any check on efficiency.
; Use clean SPL #0,#0 and JMP #0,0 to avoid triggering antifang?
; Better, use small offset to place DAT bomb somewhere useful?

; Ins5: Problem may be time wasted on life checks before
; the damage is repaired. Better to start life check _only_ on
; real repair, not when just at end of loop? Seems to work,
; winning 2/7 against weak Dat bomber DB1! Often seems to have
; 4-7 proc active. Faster way to do life check?

; Ins4 managed to repair one error, but succumbed to 0.6c DAT
; bomber DB1.

; Insear3 puts SC in main loop. Note bug in earlier versions;
; I was using an in-code DJN #70 to time clear!
; Currently no reanimation, so hurt by DAT bombs and imps.
; Runs, late self stun d.t. MUL not MOD.
; To stagger selfchecks, change P1P2 not scan!

; Insearch2 raises scan rate to 0.8c
; A should also compare B with C to reduce the number of
; failure modes. However, looks as if SC rate too low to
; be effective, so put SC in main loop.
; Scan at 0.5c. Length ~27x3 so self scan every 700 scans
; => 1400 cycles. Starting clear after 3x70 self scans gives
; a run of 3x70x1400 ~ 300k?

; Obvious attack is Imp or J0, but SPL/JMP beats scanners?
; Vulnerable to step sizes close to GAP.
; Imps should be dead so clear can be shortened?
; Currently all will selfcheck at same time. Stagger?

; New failure mode -- if SPtr is overwritten,scan will fail
; for equal steps. => unequal!
; Perhaps I should check for overwrite of SPtr. Copying own
; SPtr (.x?) would prevent some kinds of rescans... but
; might also lead to looping.

; Add some increments to SPtr in selfcheck and bomb code to
; guarantee I pass life test.
; Better to do life test only every scan reset?
; Should second life check be at start or end?
; Better resistance to imps if I check forwards and lifecheck
; only after a complete scan?

;---- Constants

STEP1 equ 269  ; Work on this!
STEP2 equ 283  ; Work on this!
SCANAT equ  300  ; Start relative to self
OFF equ 100  ; Phasing between scanners
GAP equ 18480  ; 55440/3
LENGTH equ (Top+1-SPtr)
CFROM   equ     (Top+2-P1P2)    ; Start check 1 after end
BLEN    equ     ((LENGTH+3)/4)  ; 4 proc boot
SPtrCp  equ (SPtr-1)

;---- Variables

SPtr    DAT     SCANAT, SCANAT+30    ; Scan pointer
FPtr    DAT     0,      0            ; Fang pointer
P1P2    DAT     CFROM-GAP,CFROM+GAP  ; Self check
SelfP DAT 0, 0
ClrCtr  DAT     70,     Clear+4-T1T2 ; # Selfscans to do

; Idea is to keep all the variables here so that the code
; from T1T2 is NOT self modifying.
; Think of it as an address space 8-)

;---- Self-Check Constants / Bombs

T1T2    SPL     #CFROM-GAP,CFROM+GAP
;b-reak
Stepper JMP #STEP1, STEP2

;---- Code

;b-reak
SAttack MOV.b   SPtr,  FPtr ; Antivamp .b field
 ADD.b  <FPtr, FPtr ; Beware inregister!
        MOV.i   SPtr,   @FPtr   ; Bomb putative Fang
        MOV.i   T1T2,   >SPtr  ; SPL/JMP Bomb
        MOV.i   Stepper,@SPtr   ; Note > to SPtr...

SLoop SEQ.i <P1P2, {P1P2 ; Compare the other two
         JMP    Check,  0000
 ADD.f Stepper,SPtr
SEntry  SNE.i   *SPtr,  @SPtr   ; Standard HSA scan engine
        ADD.f   Stepper,SPtr    ; SNE.i for 50% of hitting
 JMN.f SSelf, @SPtr   ; MOV {0,}0 etc
 JMZ.f SLoop,  *SPtr
 MOV.x SPtr, SPtr

SSelf MOV.ba SPtr, FPtr
        MOD.a   #GAP,   FPtr
        SLT.ab  FPtr,   #LENGTH ; Don't bomb any of triad
  JMP SAttack,0000 ; Check syntax
        DJN.a   SLoop,  ClrCtr  ; Scan self ClrCtr times...

Clear   MOV.i   ClrCtr, <T1T2   ; Forward clear with Gate
        ADD     #3,     T1T2    ; Imps should be dead so
        JMP     Clear,  <T1T2   ; shorten?

; Has to find whether in code or variables
; before copying; if in var, reset pointers.

Check   MOV.f SPtr+GAP, SPtrCp+GAP ; for life check

 SLT.ab  #(T1T2-P1P2)+GAP, P1P2 ; Constant?
         JMP    Reset,  0000

;b-reak
        MOV.b   P1P2,   SelfP   ; Defect discovered
        SUB.ab  #(GAP+1), SelfP ; Generate pointer into self
        MOV.i   @SelfP, *P1P2   ; and overwrite both of others
        MOV.i   @SelfP, @P1P2   ;

 SNE.f SPtr+GAP, SPtrCp+GAP ; alive?
  SPL    LifeChk+GAP
  JMP SLoop, 0000 ;

Reset MOV.f   T1T2,   P1P2    ; Reset check pointer
 JMP SLoop,  0000

;b-reak
LifeChk JMN.a   Top, SelfP   ; Suicide if check underway
        MOV.a   #20,    SelfP   ; Wait for signs of life
        DJN.a   #0,     SelfP
 	SNe.F SPtr, SPtrCp  ; Second life check
        JMP    SEntry
Top     DAT     0,      0


        DAT     0,      0 ; This DAT must be checked
    ; to avoid leaking into imp
        DAT     0,      0

;---- Gap

for 100
        DAT     1,      TP3+100 ; Debugging target!
rof

;---- Launch

FP1     SPL     1,      SPtr+BLEN*4
FP2     SPL     1,      SPtr+BLEN*4

for BLEN
 MOV <FP1, <TP1
 MOV <FP2, <TP2
rof

        JMP     *TP1,   }0      ; Sprinkle processes
TP1     DAT     SEntry+GAP, SPtr+BLEN*4+GAP
TP2     DAT     SEntry-GAP, SPtr+BLEN*4-GAP
TP3     DAT     SEntry, 0000

        MOV     0,      TP1     ; .a must be Zero
        MOV     0,      TP2

;       DAT     0, 0            ; Debugging only
;       DAT     #GAP, LENGTH
;       DAT     CFROM, BLEN

 end FP1

