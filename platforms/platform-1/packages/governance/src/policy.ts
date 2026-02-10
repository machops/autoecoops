export class Policy {
  constructor() {
    console.log('Policy Engine initialized');
  }

  async check(input: any): Promise<boolean> {
    return true;
  }
}