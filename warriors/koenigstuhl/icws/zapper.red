;redcode
;name Zapper
;author Bryan Turner
;assert 1

; From "Dereference and Attack - Part 2 of Helping Goliath Win."
; by Bryan Turner in The Core War Newsletter vol 6, no 3, Summer 1993

; Zapper
; By Bryan Turner
; U.S.A. '93
;
; Effectively shows the power of dereference-attacking.
; Pitted against Dwarf, vampires, and other pointer
;   throwing relatives, it maims or destroys the enemy
;   very quickly and with little effort.
; -Even against the ICWST'92 winner 'RotLD 2.2'!
;
; Scan Routine
;
scan      add #411,t1  ;Scans unevenly to
          jmz scan,@t1 ;catch as much as possible
;
; Dereference Routine
;
findit    mov t1,t2
          sub @t1,t1    ;Look above the bomb..
          jmn 4,@t1     ;Yes!

          mov t2,t1     ;Nope...
          add @t1,t1    ;Look below the bomb..
          jmz scan,@t1  ;Nope, dead end!
;
; Attack Routine
;
          add #5, t1    ;Quickly destroy
killit    mov bomb,<t1  ;5 addresses
          mov bomb,<t1  ;around the location.
          djn killit,#5
          mov #5,-1
          jmp scan
bomb      dat #0
t1        dat #4
t2        dat #0

