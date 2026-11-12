; published in The Core War Newsletter, Spring 1993
; added # to all dats to compile under ICWS'88 rules

;redcode-icws
;name Paragon 5
;author Bryan Turner
;assert CORESIZE==8192

;
; Paragon 5
; By Bryan Turner
; U.S.A. '93
;
;
; Multi-functional goliath.
; 2 scanners examine
;  the core, when a non-
;  zero element is found,
;  it is compared to a set
;  of possible opponents
;  like: Imp, dwarf, SPL
;  bomber, Mice, Vampire.
;  It then launches the
;  most appropriate
;  countermeasure for that
;  type of enemy.
; Wins a good percentage of
;  battles if the enemy
;  is correctly recognized
;  in time.
;
start     spl scan1
          jmp scan2
stack     dat #0
look      dat #-2
top       dat #8100
hold      dat #0
scan1     add #892,s1
;Scan core....
          jmz -1,@s1
          slt s1,top
          jmp scan1
          mov @s1,<stack
          jmp test
scan2     add #-412,s2
;Scan some more...
          jmz -1,@s2
          slt s2,top
          jmp scan2
          mov @s2,<stack
          jmp test
test      mov hold,0
;Get what we saw,
          mov @look,hold
;and take due actions
          cmp hold,imp
;Is it an imp?
          jmp 2
          jmp contra
          sub hold,hold
;clear the arguments
          cmp hold,fang
;Is it an SPL bomber?
          jmp 2
          jmp piper
          cmp hold,fang2
;Is it a Vampire?
          jmp 2
          jmp piper
          cmp hold,data
;Is it a DAT bomber?
          jmp 2
          jmp source
help      spl quick
          djn 0,#0   ;If we haven't died after all
          djn 0,#0   ;this time, we've got probs
          spl worm   ;.. a worm should do the trick!
          jmp 0      ;and let's keep one in reserve.
fang2     spl @0,0
data      dat #0,#0
;
; Mice Type - Mice ][
;
source    mov #13,0
loop      mov <source,<dest
          jmn loop,source
          spl @dest
          add #653,dest
          jmz source,source
dest      dat #833
;
; Fast Bomber - 'Lil Piper
;
piper     add 3,1   ;off-step stone bomber
          mov <3,3
          jmp -2,<1
          dat #1905,#-5
;
; SPL Bomber - Quickling
;
fang      spl 0,1
quick     add #892,v1
          jmz -1,@v1
          slt v1,top
;don't wanna hit ourself!
          jmp quick,<v1
          mov fang,@v1
          djn quick,#70
;modified for Paragon 5
          jmp source
;normally shoots
;indefinitely
;
; Imp - .5 Worm
;
worm      spl 0
          djn 2,#4
          mov -1,-2
imp       mov 0,1

;
; Imp Buster - Contra
;
wall      jmp 1
          jmp work
contra    jmp 0,<wall
v2        dat #wall
kill      dat #1993,#1993
work      spl 0
          mov kill,<v2
          jmp -1

;
;
s1        dat #0
v1        dat #0
s2        dat #0
          end start
