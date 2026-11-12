;redcode
;name MarriedV4
;author Skybuck Flying
;strategy Dual Warrior, Dead/Alive Detector, Healing skeleton
;version 4
;history version 1 created on 30 november 2007, demonstrates the concept of 
; flags.
;history version 2 created on 2 december 2007, healing skeleton.
;history version 3 created on 3 december 2007, optimizations.
;history version 4 created on 3 december 2007, defective warrior instance 
; killed off
; main thread starts/spawns warrior 1, and then executes warrior 2 by 
; jumping to it.
;assert 1

spl Warrior1Start
jmp Warrior2Start


 Warrior1Length equ Warrior1End - Warrior1Start

 Warrior1CheckWarrior2ForSignOfLife
 Warrior1HealWarrior2
 Warrior1AskWarrior2ForSignOfLife
  ; check if warrior 2 is dead,
  ; if dead then jmp to warrior 1 healing code, to heal warrior 2
  ; challenge warrior2 to set it's flag to alive
Warrior1Start
  jmz Warrior1HealingCode, <Warrior2FlagAlive

 Warrior1GiveSignOfLife
 Warrior1Loop
  ; set our own flag to alive
  jmp Warrior1Start, >Warrior1FlagAlive ; let the world now we are alive :)

 Warrior1Data

 Warrior1FlagAlive
  dat $0, $2  ; 1 = true, 0 = false, A-field unused B-field is status 
              ; dat is better to kill off defects

 Warrior1HealingCode
  ; let's kill warrior2 for sure !
  mov Warrior1Bomb, >Warrior1BombCounter
  djn.a Warrior1HealingCode, Warrior1BombCounter

 Warrior1Return
  jmp Warrior1Start

 Warrior1BombCounter dat #Warrior2Length, #Warrior2Start
 Warrior1Bomb  dat $0, $0

Warrior1End


 Warrior2Length equ Warrior2End - Warrior2Start

 Warrior2CheckWarrior1ForSignOfLife
 Warrior2HealWarrior1
 Warrior2AskWarrior1ForSignOfLife
  ; check if warrior 1 is dead,
  ; if dead then jmp to warrior 2 healing code, to heal warrior 1
  ; challenge warrior1 to set it's flag to alive
Warrior2Start
  jmz Warrior2HealingCode, <Warrior1FlagAlive

 Warrior2GiveSignOfLife
 Warrior2Loop
  ; set our own flag to alive
  jmp Warrior2Start, >Warrior2FlagAlive ; let the world now we are alive :)

 Warrior2Data

 Warrior2FlagAlive
  dat $0, $2  ; 1 = true, 0 = false, A-field unused B-field is status 
              ; dat is better to kill off defects

 Warrior2HealingCode
  ; let's kill warrior1 for sure !
  mov Warrior2Bomb, >Warrior2BombCounter
  djn.a Warrior2HealingCode, Warrior2BombCounter

 Warrior2Return
  jmp Warrior2Start

 Warrior2BombCounter dat #Warrior1Length, #Warrior1Start
 Warrior2Bomb  dat $0, $0

Warrior2End

	end


